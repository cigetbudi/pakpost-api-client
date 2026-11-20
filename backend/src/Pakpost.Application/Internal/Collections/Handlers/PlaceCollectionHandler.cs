using Mediator;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Application.Internal.Collections.Services;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class PlaceCollectionHandler(
    ICollectionRepository collections, IWorkspaceRepository workspaces,
    IUnitOfWork unitOfWork, ITransactionManager transactions)
    : IRequestHandler<PlaceCollectionCommand, CollectionDto>
{
    public async ValueTask<CollectionDto> Handle(PlaceCollectionCommand command, CancellationToken ct)
    {
        await using var transaction = await transactions.BeginSerializableAsync(ct);
        await WorkspacePermissions.RequireAsync(workspaces, command.WorkspaceId, command.ActorId,
            WorkspacePermissions.CollectionWrite, ct);
        var items = await collections.ListForOrganizationAsync(command.WorkspaceId, ct);
        CollectionPlacementRules.Arrange(items, command.CollectionId, command.TargetCollectionId, command.Placement);
        await unitOfWork.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        var source = items.Single(item => item.Id == command.CollectionId);
        return new CollectionDto(source.Id, source.WorkspaceId, source.Name, 0,
            source.ParentCollectionId, source.SortOrder);
    }
}
