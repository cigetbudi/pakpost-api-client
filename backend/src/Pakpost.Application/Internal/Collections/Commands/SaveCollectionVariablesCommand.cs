using System.Text.Json;
using Mediator;
using Pakpost.Application.Internal.Collections.DTOs;

namespace Pakpost.Application.Internal.Collections.Commands;

public sealed record SaveCollectionVariablesCommand(Guid ActorId, Guid WorkspaceId, Guid CollectionId,
    int Version, List<CollectionVariableDto> Variables) : IRequest<CollectionVariablesDto>;
