using Mediator;
using Pakpost.Application.Internal.Collections.DTOs;

namespace Pakpost.Application.Internal.Collections.Commands;

public sealed record DeleteFolderItemsCommand(Guid ActorId, Guid WorkspaceId, Guid CollectionId,
    IReadOnlyList<FolderDeleteTarget> Folders, IReadOnlyList<Guid> RequestIds):IRequest;
