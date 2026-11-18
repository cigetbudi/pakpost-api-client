using System.Text.Json;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Application.Internal.Collections.Services;
using Pakpost.Application.Internal.Collections.Validators;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class ImportCollectionsHandler(
    IWorkspaceRepository workspaces,
    ICollectionRepository collections,
    ISavedRequestRepository requests,
    ISavedRequestRevisionRepository revisions,
    IEnvironmentValueCipher cipher,
    IUnitOfWork unitOfWork,
    ICollectionFolderRepository folders)
    : IRequestHandler<ImportCollectionsCommand, CloudImportResult>
{
    public async ValueTask<CloudImportResult> Handle(
        ImportCollectionsCommand command,
        CancellationToken cancellationToken)
    {
        await WorkspacePermissions.RequireAsync(
            workspaces,
            command.WorkspaceId,
            command.ActorId,
            WorkspacePermissions.CollectionWrite,
            cancellationToken);

        if (command.Collections is not { Count: > 0 and <= 30 } ||
            command.Collections.Any(item => item is null || item.Requests is null || item.Variables is null) ||
            command.Collections.Sum(item => item.Requests.Count) > 200)
        {
            throw AppException.BadRequest("Cloud import limits exceeded (30 collections, 200 requests)");
        }

        var requestValidator = new SaveRequestValidator();
        var variablesValidator = new SaveCollectionVariablesValidator();
        var createdCollections = new List<CollectionDto>();
        var requestCount = 0;

        foreach (var incomingCollection in command.Collections)
        {
            if (string.IsNullOrWhiteSpace(incomingCollection.Name) ||
                incomingCollection.Name.Trim().Length > 120)
            {
                throw AppException.BadRequest("Collection name must be 1–120 characters");
            }

            var variableCheck = variablesValidator.Validate(new SaveCollectionVariablesCommand(
                command.ActorId,
                command.WorkspaceId,
                Guid.Empty,
                0,
                incomingCollection.Variables));

            if (!variableCheck.IsValid)
            {
                throw AppException.BadRequest(
                    "Invalid collection variables: " + variableCheck.Errors[0].ErrorMessage);
            }

            var storedVariables = CollectionVariableMapper.ToStored(
                incomingCollection.Variables,
                [],
                cipher);

            var collection = new Collection(
                command.WorkspaceId,
                incomingCollection.Name,
                command.ActorId);

            if (storedVariables.Count > 0)
            {
                collection.SetVariables(JsonSerializer.Serialize(storedVariables));
            }

            collections.Add(collection);

            var pathFolders = new Dictionary<string, CollectionFolder>(
                StringComparer.OrdinalIgnoreCase);

            foreach (var incoming in incomingCollection.Requests)
            {
                if (incoming is null)
                {
                    throw AppException.BadRequest("Request cannot be null");
                }

                var validation = requestValidator.Validate(new SaveRequestCommand(
                    command.ActorId,
                    command.WorkspaceId,
                    collection.Id,
                    incoming.Name,
                    incoming.Method,
                    incoming.Url,
                    incoming.HeadersJson,
                    incoming.Body,
                    incoming.BodyMode,
                    incoming.ContentType,
                    incoming.FormFieldsJson,
                    incoming.PreRequestScript,
                    incoming.PostResponseScript));

                if (!validation.IsValid)
                {
                    throw AppException.BadRequest(
                        "Invalid imported request: " + validation.Errors[0].ErrorMessage);
                }

                SavedHeaderPolicy.EnsureSafe(incoming.HeadersJson);

                Guid? folderId = null;

                if (incoming.FolderPath is { Count: > 0 } path)
                {
                    if (path.Count > 24)
                    {
                        throw AppException.BadRequest("Imported folder depth exceeds 24");
                    }

                    var currentPath = "";

                    foreach (var segment in path)
                    {
                        if (string.IsNullOrWhiteSpace(segment) || segment.Trim().Length > 120)
                        {
                            throw AppException.BadRequest("Invalid imported folder segment");
                        }

                        var name = segment.Trim();
                        currentPath += name.Length + ":" + name + "/";

                        if (!pathFolders.TryGetValue(currentPath, out var folder))
                        {
                            if (pathFolders.Count >= 500)
                            {
                                throw AppException.BadRequest("Folder limit: 500 per collection");
                            }

                            folder = new CollectionFolder(collection.Id, folderId, name);
                            pathFolders[currentPath] = folder;
                            folders.Add(folder);
                        }

                        folderId = folder.Id;
                    }
                }

                var request = new SavedRequest(
                    collection.Id,
                    incoming.Name,
                    incoming.Method,
                    incoming.Url,
                    incoming.HeadersJson,
                    incoming.Body,
                    incoming.BodyMode,
                    incoming.ContentType,
                    incoming.FormFieldsJson,
                    incoming.PreRequestScript,
                    incoming.PostResponseScript,
                    folderId);

                requests.Add(request);
                revisions.Add(SavedRequestHistoryCodec.Capture(request, command.ActorId, "created", cipher));
                requestCount++;
            }

            createdCollections.Add(new CollectionDto(
                collection.Id,
                collection.WorkspaceId,
                collection.Name,
                incomingCollection.Requests.Count));
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new CloudImportResult(
            requestCount,
            createdCollections.Count,
            createdCollections[0].Id,
            createdCollections);
    }
}
