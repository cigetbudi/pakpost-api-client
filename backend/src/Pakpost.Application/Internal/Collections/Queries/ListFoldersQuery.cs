using Mediator;
using Pakpost.Application.Internal.Collections.DTOs;

namespace Pakpost.Application.Internal.Collections.Queries;

public sealed record ListFoldersQuery(Guid ActorId, Guid WorkspaceId, Guid CollectionId) : IRequest<IReadOnlyList<FolderDto>>;
