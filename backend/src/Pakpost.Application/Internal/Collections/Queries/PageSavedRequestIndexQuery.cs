using Mediator;
using Pakpost.Application.Internal.Collections.DTOs;

namespace Pakpost.Application.Internal.Collections.Queries;

public sealed record PageSavedRequestIndexQuery(
    Guid ActorId, Guid WorkspaceId, Guid CollectionId, int Size = 120,
    string? After = null, string? Search = null, Guid? FolderId = null,
    bool RootOnly = false, bool SortByName = false)
    : IRequest<SavedRequestIndexPageDto>;
