using Mediator;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Application.Internal.Collections.DTOs;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class DeleteFolderHandler(
    IWorkspaceRepository workspaces,
    ICollectionRepository collections,
    ICollectionFolderRepository folders,
    ISavedRequestRepository requests,
    IUnitOfWork unitOfWork,
    ITransactionManager transactions)
    : IRequestHandler<DeleteFolderCommand>
{
    public ValueTask<Unit> Handle(DeleteFolderCommand command, CancellationToken ct)
    {
        var deletion = new DeleteFolderItemsCommand(
            command.ActorId,
            command.WorkspaceId,
            command.CollectionId,
            [new FolderDeleteTarget(command.FolderId, command.ExpectedVersion)],
            []);

        var handler = new DeleteFolderItemsHandler(
            workspaces,
            collections,
            folders,
            requests,
            unitOfWork,
            transactions);

        return handler.Handle(deletion, ct);
    }
}
