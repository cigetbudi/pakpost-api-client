using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class DeleteCollectionHandler(
    ICollectionRepository collections,
    IWorkspaceRepository workspaces,
    IUnitOfWork uow
) : IRequestHandler<DeleteCollectionCommand>
{
    public async ValueTask<Unit> Handle(DeleteCollectionCommand cmd, CancellationToken ct)
    {
        await WorkspacePermissions.RequireAsync(workspaces, cmd.WorkspaceId, cmd.ActorId, WorkspacePermissions.CollectionWrite, ct);
        var item = await collections.FindAsync(cmd.CollectionId, ct);
        if (item is null || item.WorkspaceId != cmd.WorkspaceId)
            throw AppException.NotFound("Collection not found");
        collections.Remove(item);
        await uow.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
