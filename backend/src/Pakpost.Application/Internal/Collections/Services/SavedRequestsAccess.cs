using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections.Services;

public static class SavedRequestsAccess
{
    public static async Task Check(
        Guid actorId,
        Guid workspaceId,
        Guid collectionId,
        IWorkspaceRepository workspaces,
        ICollectionRepository collections,
        CancellationToken cancellationToken,
        bool destructive = false)
    {
        await WorkspacePermissions.RequireAsync(
            workspaces,
            workspaceId,
            actorId,
            destructive ? WorkspacePermissions.CollectionWrite : WorkspacePermissions.CollectionRead,
            cancellationToken);

        if (!await collections.ExistsInWorkspaceAsync(collectionId, workspaceId, cancellationToken))
        {
            throw AppException.NotFound("Collection not found");
        }
    }

    public static SavedRequestDto ToDto(SavedRequest request)
    {
        return new SavedRequestDto(
            request.Id,
            request.CollectionId,
            request.Name,
            request.Method,
            request.Url,
            SavedHeaderPolicy.RedactLegacyCredentials(request.HeadersJson),
            request.Body,
            request.BodyMode,
            request.ContentType,
            request.FormFieldsJson,
            request.PreRequestScript,
            request.PostResponseScript,
            request.Revision,
            request.FolderId);
    }
}
