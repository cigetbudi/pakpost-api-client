using Mediator;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Application.Internal.Collections.DTOs;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class DeleteFolderHandler(
    IWorkspaceRepository w,
    ICollectionRepository c,
    ICollectionFolderRepository f,
    ISavedRequestRepository r,
    IUnitOfWork uow)
    : IRequestHandler<DeleteFolderCommand>
{
    public async ValueTask<Unit> Handle(DeleteFolderCommand q, CancellationToken ct)
    => await new DeleteFolderItemsHandler(w, c, f, r, uow).Handle(new DeleteFolderItemsCommand(q.ActorId, q.WorkspaceId, q.CollectionId,
        [new FolderDeleteTarget(q.FolderId, q.ExpectedVersion)], []), ct);
}
// A single UnitOfWork removes all selected requests and folder descendants atomically.
// Only explicit roots require a version; descendants are still protected by EF concurrency.
