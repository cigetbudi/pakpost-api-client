using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections.Services;

public static class SavedRequestHistoryAccess
{
    public static async Task<SavedRequest> Check(
        Guid actorId,
        Guid workspaceId,
        Guid collectionId,
        Guid requestId,
        bool write,
        IWorkspaceRepository workspaces,
        ICollectionRepository collections,
        ISavedRequestRepository requests,
        CancellationToken cancellationToken)
    {
        await WorkspacePermissions.RequireAsync(
            workspaces,
            workspaceId,
            actorId,
            write ? WorkspacePermissions.CollectionWrite : WorkspacePermissions.CollectionRead,
            cancellationToken);

        var collection = await collections.FindAsync(collectionId, cancellationToken);

        if (collection is null || collection.WorkspaceId != workspaceId)
        {
            throw AppException.NotFound("Collection not found");
        }

        var request = await requests.FindAsync(requestId, cancellationToken);

        if (request is null || request.CollectionId != collectionId)
        {
            throw AppException.NotFound("Saved request not found");
        }

        return request;
    }
}
