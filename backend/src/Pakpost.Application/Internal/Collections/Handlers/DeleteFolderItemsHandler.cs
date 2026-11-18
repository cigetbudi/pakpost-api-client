using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Application.Internal.Collections.Services;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class DeleteFolderItemsHandler(
    IWorkspaceRepository workspaces, ICollectionRepository collections,
    ICollectionFolderRepository folders, ISavedRequestRepository requests, IUnitOfWork uow)
    : IRequestHandler<DeleteFolderItemsCommand>
{
    public async ValueTask<Unit> Handle(DeleteFolderItemsCommand cmd, CancellationToken ct)
    {
        await CloudFolderRules.CheckAccess(cmd.ActorId, cmd.WorkspaceId, cmd.CollectionId, true, workspaces, collections, ct);
        if (cmd.Folders is null || cmd.RequestIds is null || cmd.Folders.Count+cmd.RequestIds.Count is 0 or > 200)
            throw AppException.BadRequest("Select 1 to 200 requests or folders");
        if (cmd.Folders.Any(x => x.Id == Guid.Empty || x.Version<1) || cmd.RequestIds.Any(x => x == Guid.Empty))
            throw AppException.BadRequest("Invalid deletion selection");
        var allFolders = await folders.ListAsync(cmd.CollectionId, ct);
        var byId = allFolders.ToDictionary(x => x.Id);
        var selectedFolderIds = cmd.Folders.Select(x => x.Id).ToHashSet();
        if (cmd.Folders.Any(x => !byId.TryGetValue(x.Id, out var folder) || folder.Version != x.Version))
            throw AppException.Conflict("A selected folder changed. Reload before deleting.");
        var deletedFolders = new HashSet<Guid>();
        // Bounded walk; no silent partial deletion if corruption creates a cycle.
        void Walk(Guid id, HashSet<Guid> path)
        {
            if (!path.Add(id))
                throw AppException.Conflict("Invalid cyclic folder hierarchy");
            deletedFolders.Add(id);
            foreach (var child in allFolders.Where(x => x.ParentFolderId == id))
                if (!deletedFolders.Contains(child.Id))Walk(child.Id, path);
            path.Remove(id);
        }
        foreach (var id in selectedFolderIds)Walk(id, new HashSet<Guid>());
        var allRequests = await requests.ListAsync(cmd.CollectionId, ct);
        var byRequestId = allRequests.ToDictionary(x => x.Id);
        if (cmd.RequestIds.Any(id => !byRequestId.ContainsKey(id)))
            throw AppException.Conflict("A selected request changed. Reload before deleting.");
        var requestsToDelete = allRequests.Where(x => cmd.RequestIds.Contains(x.Id)
            || (x.FolderId is Guid folder && deletedFolders.Contains(folder))).ToArray();
        // Both repository methods stage tracked deletes; EF commits them in one SaveChanges transaction.
        foreach (var request in requestsToDelete)requests.Remove(request);
        foreach (var folder in allFolders.Where(x => deletedFolders.Contains(x.Id)))folders.Remove(folder);
        await uow.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
