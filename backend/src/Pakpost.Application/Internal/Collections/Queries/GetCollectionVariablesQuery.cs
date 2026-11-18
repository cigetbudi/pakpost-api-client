using System.Text.Json;
using Mediator;
using Pakpost.Application.Internal.Collections.DTOs;

namespace Pakpost.Application.Internal.Collections.Queries;

public sealed record GetCollectionVariablesQuery(Guid ActorId, Guid WorkspaceId, Guid CollectionId)
    : IRequest<CollectionVariablesDto>;
