using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class RenameCollectionHandler(
    ICollectionRepository collections,
    IWorkspaceRepository workspaces,
    IUnitOfWork uow
) : IRequestHandler<RenameCollectionCommand, CollectionDto>
{
    public async ValueTask<CollectionDto> Handle(RenameCollectionCommand cmd, CancellationToken ct)
    {
        await WorkspacePermissions.RequireAsync(workspaces, cmd.WorkspaceId, cmd.ActorId, WorkspacePermissions.CollectionWrite, ct);
        var item = await collections.FindAsync(cmd.CollectionId, ct);
        if (item is null || item.WorkspaceId != cmd.WorkspaceId)
            throw AppException.NotFound("Collection not found");
        item.Rename(cmd.Name);
        await uow.SaveChangesAsync(ct);
        return new(item.Id, item.WorkspaceId, item.Name);
    }
}
