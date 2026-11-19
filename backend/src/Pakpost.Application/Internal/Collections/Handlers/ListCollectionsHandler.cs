using Mediator;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Application.Internal.Collections.Queries;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class ListCollectionsHandler(
    ICollectionRepository collections,
    IWorkspaceRepository workspaces)
    : IRequestHandler<ListCollectionsQuery, IReadOnlyList<CollectionDto>>
{
    public async ValueTask<IReadOnlyList<CollectionDto>> Handle(
        ListCollectionsQuery query,
        CancellationToken ct)
    {
        await WorkspacePermissions.RequireMemberAsync(
            workspaces,
            query.WorkspaceId,
            query.ActorId,
            ct);

        var items = await collections.ListOverviewAsync(query.WorkspaceId, ct);

        return items
            .Select(collection => new CollectionDto(
                collection.Id,
                collection.WorkspaceId,
                collection.Name,
                collection.RequestCount))
            .ToArray();
    }
}
