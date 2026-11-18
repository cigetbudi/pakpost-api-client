using System.Text.Json;
using Mediator;
using Pakpost.Application.Internal.Collections.DTOs;

namespace Pakpost.Application.Internal.Collections.Commands;

public sealed record ImportCollectionsCommand(Guid ActorId, Guid WorkspaceId,
    List<CloudImportCollection> Collections) : IRequest<CloudImportResult>;
