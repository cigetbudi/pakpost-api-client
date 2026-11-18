using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Application.Internal.Collections.Queries;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class ListCollectionsHandler(ICollectionRepository collections, IWorkspaceRepository workspaces)
    : IRequestHandler<ListCollectionsQuery, IReadOnlyList<CollectionDto>>
{
    public async ValueTask<IReadOnlyList<CollectionDto>> Handle(ListCollectionsQuery query, CancellationToken ct)
    {
        if (await workspaces.FindMemberAsync(query.WorkspaceId, query.ActorId, ct) is null)
            throw AppException.Forbidden();
        var items = await collections.ListAsync(query.WorkspaceId, ct);
        var counts = await collections.CountRequestsAsync(query.WorkspaceId, ct);
        return items.Select(x => new CollectionDto(x.Id, x.WorkspaceId, x.Name,
            counts.TryGetValue(x.Id, out var count)?count:0)).ToArray();
    }
}
