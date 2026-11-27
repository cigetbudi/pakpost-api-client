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

        CloudImportGuard.ValidateBatch(command);
        var requestValidator = new SaveRequestValidator();
        var variablesValidator = new SaveCollectionVariablesValidator();

        var createdCollections = new List<CollectionDto>();
        var requestCount = 0;

        foreach (var incomingCollection in command.Collections)
        {
            CloudImportGuard.ValidateCollection(command, incomingCollection, variablesValidator);

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

            CollectionScriptSettings.Apply(collection, incomingCollection.PreScript, incomingCollection.PostScript);
            collections.Add(collection);

            var pathFolders = new ImportedFolderPathResolver(collection.Id, folders);

            foreach (var incoming in incomingCollection.Requests)
            {
                CloudImportGuard.ValidateRequest(command, collection.Id, incoming, requestValidator);

                var folderId = pathFolders.Resolve(incoming.FolderPath);

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
