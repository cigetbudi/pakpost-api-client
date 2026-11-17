using System.Text.Json;
using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections;

// One SaveChangesAsync for the entire batch. EF Core wraps multiple inserts in a transaction.
// No intermediate collections are visible if validation/encryption/database persistence fails.
public sealed record CloudImportRequest(string Name, string Method, string Url, string HeadersJson,
    string Body, string BodyMode = "raw", string ContentType = "application/json",
    string FormFieldsJson = "[]", string PreRequestScript = "", string PostResponseScript = "", List<string>? FolderPath = null);
public sealed record CloudImportCollection(string Name, List<CollectionVariableDto> Variables,
    List<CloudImportRequest> Requests);
public sealed record ImportCollectionsCommand(Guid ActorId, Guid WorkspaceId,
    List<CloudImportCollection> Collections) : IRequest<CloudImportResult>;
public sealed record CloudImportResult(int Count, int CreatedCount, Guid? FirstId,
    IReadOnlyList<CollectionDto> Collections);

public sealed class ImportCollectionsValidator : AbstractValidator<ImportCollectionsCommand>
{
    public ImportCollectionsValidator()
    {
        RuleFor(x => x.Collections).NotNull().Must(x => x is { Count: > 0 and <= 30 })
            .WithMessage("Import requires between 1 and 30 collections");
        RuleFor(x => x.Collections).Must(x => x is not null && x.All(c => c is not null && c.Requests is not null && c.Variables is not null)
            && x.Sum(c => c.Requests.Count) <= 200).WithMessage("Cloud import supports at most 200 requests");
    }
}

public sealed class ImportCollectionsHandler(IWorkspaceRepository workspaces,
    ICollectionRepository collections, ISavedRequestRepository requests,
    ISavedRequestRevisionRepository revisions, IEnvironmentValueCipher cipher,
    IUnitOfWork uow, ICollectionFolderRepository folders) : IRequestHandler<ImportCollectionsCommand, CloudImportResult>
{
    public async ValueTask<CloudImportResult> Handle(ImportCollectionsCommand cmd, CancellationToken ct)
    {
        await WorkspacePermissions.RequireAsync(workspaces, cmd.WorkspaceId, cmd.ActorId,
            WorkspacePermissions.CollectionWrite, ct);
        if (cmd.Collections is not { Count: > 0 and <= 30 } ||
            cmd.Collections.Any(c => c is null || c.Requests is null || c.Variables is null) ||
            cmd.Collections.Sum(c => c.Requests.Count) > 200)
            throw AppException.BadRequest("Cloud import limits exceeded (30 collections, 200 requests)");

        var requestValidator = new SaveRequestValidator();
        var variablesValidator = new SaveCollectionVariablesValidator();
        var created = new List<CollectionDto>();
        var count = 0;
        foreach (var item in cmd.Collections)
        {
            if (string.IsNullOrWhiteSpace(item.Name) || item.Name.Trim().Length > 120)
                throw AppException.BadRequest("Collection name must be 1–120 characters");
            var variableCheck = variablesValidator.Validate(new SaveCollectionVariablesCommand(
                cmd.ActorId, cmd.WorkspaceId, Guid.Empty, 0, item.Variables));
            if (!variableCheck.IsValid)
                throw AppException.BadRequest("Invalid collection variables: " + variableCheck.Errors[0].ErrorMessage);

            // Encrypt before persistence; an unavailable cipher key fails the entire batch.
            var stored = CollectionVariableMapper.ToStored(item.Variables, [], cipher);
            var col = new Collection(cmd.WorkspaceId, item.Name, cmd.ActorId);
            if (stored.Count > 0) col.SetVariables(JsonSerializer.Serialize(stored));
            collections.Add(col);
            var pathFolders = new Dictionary<string, CollectionFolder>(StringComparer.OrdinalIgnoreCase);
            foreach (var incoming in item.Requests)
            {
                if (incoming is null) throw AppException.BadRequest("Request cannot be null");
                var check = requestValidator.Validate(new SaveRequestCommand(cmd.ActorId, cmd.WorkspaceId,
                    col.Id, incoming.Name, incoming.Method, incoming.Url, incoming.HeadersJson,
                    incoming.Body, incoming.BodyMode, incoming.ContentType, incoming.FormFieldsJson,
                    incoming.PreRequestScript, incoming.PostResponseScript));
                if (!check.IsValid)
                    throw AppException.BadRequest("Invalid imported request: " + check.Errors[0].ErrorMessage);
                SavedHeaderPolicy.EnsureSafe(incoming.HeadersJson);
                Guid? folderId=null;
                if(incoming.FolderPath is { Count: > 0 } path)
                {
                    if(path.Count>24)throw AppException.BadRequest("Imported folder depth exceeds 24");
                    var currentPath="";
                    foreach(var segment in path)
                    {
                        if(string.IsNullOrWhiteSpace(segment)||segment.Trim().Length>120)
                            throw AppException.BadRequest("Invalid imported folder segment");
                        var name=segment.Trim();
                        currentPath+=name.Length+":"+name+"/"; // unambiguous length-prefixed path key
                        if(!pathFolders.TryGetValue(currentPath,out var folder))
                        {
                            if(pathFolders.Count>=500)throw AppException.BadRequest("Folder limit: 500 per collection");
                            folder=new CollectionFolder(col.Id,folderId,name);
                            pathFolders[currentPath]=folder;folders.Add(folder);
                        }
                        folderId=folder.Id;
                    }
                }
                var request = new SavedRequest(col.Id, incoming.Name, incoming.Method, incoming.Url,
                    incoming.HeadersJson, incoming.Body, incoming.BodyMode, incoming.ContentType,
                    incoming.FormFieldsJson, incoming.PreRequestScript, incoming.PostResponseScript, folderId);
                requests.Add(request);
                revisions.Add(SavedRequestHistoryCodec.Capture(request, cmd.ActorId, "created", cipher));
                count++;
            }
            created.Add(new CollectionDto(col.Id, col.WorkspaceId, col.Name, item.Requests.Count));
        }

        // EF Core relational SaveChanges is atomic: no partial success is returned.
        await uow.SaveChangesAsync(ct);
        return new CloudImportResult(count, created.Count, created[0].Id, created);
    }
}
