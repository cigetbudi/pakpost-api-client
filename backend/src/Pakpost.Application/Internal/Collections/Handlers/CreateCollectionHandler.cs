using Mediator;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class CreateCollectionHandler(ICollectionRepository collections, IWorkspaceRepository workspaces, IUnitOfWork uow)
    : IRequestHandler<CreateCollectionCommand, CollectionDto>
{
    public async ValueTask<CollectionDto> Handle(CreateCollectionCommand request, CancellationToken ct)
    {
        await WorkspacePermissions.RequireAsync(workspaces, request.WorkspaceId, request.ActorId,
            WorkspacePermissions.CollectionWrite, ct);
        var col = new Collection(request.WorkspaceId, request.Name, request.ActorId);
        collections.Add(col);
        await uow.SaveChangesAsync(ct);
        return new(col.Id, col.WorkspaceId, col.Name);
    }
}
