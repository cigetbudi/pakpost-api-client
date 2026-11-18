using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Application.Internal.Collections.Services;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class DeleteFolderItemsHandler(
    IWorkspaceRepository workspaces,
    ICollectionRepository collections,
    ICollectionFolderRepository folders,
    ISavedRequestRepository requests,
    IUnitOfWork unitOfWork)
    : IRequestHandler<DeleteFolderItemsCommand>
{
    public async ValueTask<Unit> Handle(DeleteFolderItemsCommand cmd, CancellationToken ct)
    {
        await CloudFolderRules.CheckAccess(
            cmd.ActorId,
            cmd.WorkspaceId,
            cmd.CollectionId,
            true,
            workspaces,
            collections,
            ct);

        if (cmd.Folders is null ||
            cmd.RequestIds is null ||
            cmd.Folders.Count + cmd.RequestIds.Count is 0 or > 200)
        {
            throw AppException.BadRequest("Select 1 to 200 requests or folders");
        }

        if (cmd.Folders.Any(folder => folder.Id == Guid.Empty || folder.Version < 1) ||
            cmd.RequestIds.Any(requestId => requestId == Guid.Empty))
        {
            throw AppException.BadRequest("Invalid deletion selection");
        }

        var allFolders = await folders.ListAsync(cmd.CollectionId, ct);
        var byId = allFolders.ToDictionary(folder => folder.Id);

        if (cmd.Folders.Any(target =>
            !byId.TryGetValue(target.Id, out var folder) || folder.Version != target.Version))
        {
            throw AppException.Conflict("A selected folder changed. Reload before deleting.");
        }

        var deletedFolders = CloudFolderRules.ExpandSubtrees(
            allFolders,
            cmd.Folders.Select(folder => folder.Id));

        var allRequests = await requests.ListAsync(cmd.CollectionId, ct);
        var byRequestId = allRequests.ToDictionary(request => request.Id);

        if (cmd.RequestIds.Any(requestId => !byRequestId.ContainsKey(requestId)))
        {
            throw AppException.Conflict("A selected request changed. Reload before deleting.");
        }

        var selectedRequestIds = cmd.RequestIds.ToHashSet();
        var requestsToDelete = allRequests.Where(request =>
            selectedRequestIds.Contains(request.Id) ||
            (request.FolderId is Guid folder && deletedFolders.Contains(folder))).ToArray();

        foreach (var request in requestsToDelete)
        {
            requests.Remove(request);
        }

        foreach (var folder in allFolders.Where(folder => deletedFolders.Contains(folder.Id)))
        {
            folders.Remove(folder);
        }

        await unitOfWork.SaveChangesAsync(ct);

        return Unit.Value;
    }
}
