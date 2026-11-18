using System.Text.Json;
using Mediator;
using Pakpost.Application.Internal.Collections.DTOs;

namespace Pakpost.Application.Internal.Collections.Commands;

public sealed record RestoreSavedRequestHistoryCommand(
    Guid ActorId,
    Guid WorkspaceId,
    Guid CollectionId,
    Guid RequestId,
    int Revision,
    int ExpectedRevision
) : IRequest<SavedRequestDto>;

// Contains the full request state only inside encrypted_snapshot, never in audit metadata.
