using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Application.Internal.Collections.Services;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class DeleteSavedRequestHandler(
    IWorkspaceRepository workspaces,
    ICollectionRepository collections,
    ISavedRequestRepository requests,
    IUnitOfWork uow)
    : IRequestHandler<DeleteSavedRequestCommand>
{
    public async ValueTask<Unit> Handle(DeleteSavedRequestCommand c, CancellationToken ct)
    {
        await SavedRequestsAccess.Check(
            c.ActorId,
            c.WorkspaceId,
            c.CollectionId,
            workspaces,
            collections,
            ct,
            destructive: true);

        var item = await requests.FindAsync(c.RequestId, ct);

        if (item is null || item.CollectionId != c.CollectionId)
        {
            throw AppException.NotFound();
        }

        requests.Remove(item);

        await uow.SaveChangesAsync(ct);

        return Unit.Value;
    }
}
