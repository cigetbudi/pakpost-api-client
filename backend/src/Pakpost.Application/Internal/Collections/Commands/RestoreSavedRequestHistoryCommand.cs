using System.Text.Json;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections;

public sealed record RestoreSavedRequestHistoryCommand(
    Guid ActorId,
    Guid WorkspaceId,
    Guid CollectionId,
    Guid RequestId,
    int Revision,
    int ExpectedRevision
) : IRequest<SavedRequestDto>;

// Contains the full request state only inside encrypted_snapshot, never in audit metadata.
