using System.Text.Json;
using Mediator;

namespace Pakpost.Application.Internal.Collections.Commands;

public sealed record DeleteSavedRequestCommand(Guid ActorId, Guid WorkspaceId, Guid CollectionId, Guid RequestId) : IRequest;
