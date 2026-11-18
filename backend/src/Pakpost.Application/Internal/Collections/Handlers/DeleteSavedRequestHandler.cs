using System.Text.Json;
using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections;

public sealed class DeleteSavedRequestHandler(
    IWorkspaceRepository workspaces,
    ICollectionRepository collections,
    ISavedRequestRepository requests,
    IUnitOfWork uow)
    : SavedRequestsAccess, IRequestHandler<DeleteSavedRequestCommand>
{
    public async ValueTask<Unit> Handle(DeleteSavedRequestCommand c, CancellationToken ct)
    {
        await Check(c.ActorId, c.WorkspaceId, c.CollectionId, workspaces, collections, ct, destructive:true);
        var item = await requests.FindAsync(c.RequestId, ct);
        if (item is null || item.CollectionId != c.CollectionId)
            throw AppException.NotFound();
        requests.Remove(item);
        await uow.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
