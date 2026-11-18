using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections;

public sealed record CreateFolderCommand(Guid ActorId, Guid WorkspaceId, Guid CollectionId, Guid? ParentFolderId, string Name) : IRequest<FolderDto>;
