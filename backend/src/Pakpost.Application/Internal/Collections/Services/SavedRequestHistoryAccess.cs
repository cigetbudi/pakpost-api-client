using System.Text.Json;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections;

public abstract class SavedRequestHistoryAccess
{
    protected static async Task<SavedRequest> Check(Guid actor, Guid workspace, Guid collection, Guid id, bool write,
        IWorkspaceRepository workspaces, ICollectionRepository collections, ISavedRequestRepository requests, CancellationToken ct)
    {
        await WorkspacePermissions.RequireAsync(workspaces, workspace, actor,
            write?WorkspacePermissions.CollectionWrite:WorkspacePermissions.CollectionRead, ct);
        var parent = await collections.FindAsync(collection, ct);
        if (parent is null || parent.WorkspaceId != workspace)
            throw AppException.NotFound("Collection not found");
        var item = await requests.FindAsync(id, ct);
        if (item is null || item.CollectionId != collection)
            throw AppException.NotFound("Saved request not found");
        return item;
    }
}
