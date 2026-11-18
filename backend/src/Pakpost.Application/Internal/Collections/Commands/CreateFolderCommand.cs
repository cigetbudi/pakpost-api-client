using Mediator;
using Pakpost.Application.Internal.Collections.DTOs;

namespace Pakpost.Application.Internal.Collections.Commands;

public sealed record CreateFolderCommand(Guid ActorId, Guid WorkspaceId, Guid CollectionId, Guid? ParentFolderId, string Name) : IRequest<FolderDto>;
