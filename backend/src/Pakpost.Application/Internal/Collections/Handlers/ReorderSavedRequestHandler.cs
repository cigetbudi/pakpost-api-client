using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Application.Internal.Collections.Services;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class ReorderSavedRequestHandler(
    IWorkspaceRepository workspaces,
    ICollectionRepository collections,
    ISavedRequestRepository requests,
    IUnitOfWork unitOfWork,
    ITransactionManager transactions)
    : IRequestHandler<ReorderSavedRequestCommand>
{
    public async ValueTask<Unit> Handle(ReorderSavedRequestCommand command, CancellationToken ct)
    {
        if (command.RequestId == command.TargetRequestId ||
            (command.Placement != "before" && command.Placement != "after"))
            throw AppException.BadRequest("Choose a different request and before/after placement");
        await using var transaction = await transactions.BeginSerializableAsync(ct);
        await SavedRequestsAccess.Check(command.ActorId, command.WorkspaceId,
            command.CollectionId, workspaces, collections, ct, destructive: true);
        var moving = await requests.FindInCollectionAsync(command.RequestId, command.CollectionId, ct);
        var target = await requests.FindInCollectionAsync(command.TargetRequestId, command.CollectionId, ct);
        if (moving is null || target is null || moving.FolderId != target.FolderId)
            throw AppException.BadRequest("Requests must be in the same folder");
        var ordered = (await requests.ListForReorderAsync(command.CollectionId, moving.FolderId, ct)).ToList();
        var item = ordered.SingleOrDefault(row => row.Id == command.RequestId);
        var reference = ordered.SingleOrDefault(row => row.Id == command.TargetRequestId);
        if (item is null || reference is null) throw AppException.Conflict("Request list changed");
        ordered.Remove(item);
        var position = ordered.IndexOf(reference) + (command.Placement == "after" ? 1 : 0);
        ordered.Insert(position, item);
        for (var index = 0; index < ordered.Count; index++) ordered[index].Reorder(index + 1);
        await unitOfWork.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Unit.Value;
    }
}
