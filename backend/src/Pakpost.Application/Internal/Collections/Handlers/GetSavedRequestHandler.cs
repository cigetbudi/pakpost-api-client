using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Application.Internal.Collections.Queries;
using Pakpost.Application.Internal.Collections.Services;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class GetSavedRequestHandler(
    IWorkspaceRepository workspaces,
    ICollectionRepository collections,
    ISavedRequestRepository requests)
    : IRequestHandler<GetSavedRequestQuery, SavedRequestDto>
{
    public async ValueTask<SavedRequestDto> Handle(GetSavedRequestQuery query, CancellationToken ct)
    {
        await SavedRequestsAccess.Check(query.ActorId, query.WorkspaceId, query.CollectionId, workspaces, collections, ct);
        var request = await requests.FindInCollectionAsync(query.RequestId, query.CollectionId, ct)
            ?? throw AppException.NotFound("Saved request not found");
        return SavedRequestsAccess.ToDto(request);
    }
}
