using System.Text.Json;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Application.Internal.Collections.Queries;
using Pakpost.Application.Internal.Collections.Services;

namespace Pakpost.Application.Internal.Collections.Handlers;

public sealed class GetSavedRequestHistoryHandler(IWorkspaceRepository workspaces, ICollectionRepository collections,
    ISavedRequestRepository requests, ISavedRequestRevisionRepository history, IEnvironmentValueCipher cipher)
    : IRequestHandler<GetSavedRequestHistoryQuery, SavedRequestHistoryDetailDto>
{
    public async ValueTask<SavedRequestHistoryDetailDto> Handle(GetSavedRequestHistoryQuery q, CancellationToken ct)
    {
        var item = await SavedRequestHistoryAccess.Check(q.ActorId, q.WorkspaceId, q.CollectionId, q.RequestId, false, workspaces, collections, requests, ct);
        var found = await history.FindAsync(item.Id, q.Revision, ct)??throw AppException.NotFound("Revision not found");
        return new(found.Revision, found.Action, found.ActorId, found.CreatedAt, SavedRequestHistoryCodec.ToDto(item, found, cipher));
    }
}
