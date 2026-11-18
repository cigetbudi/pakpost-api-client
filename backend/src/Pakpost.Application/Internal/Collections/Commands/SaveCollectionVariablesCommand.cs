using System.Text.Json;
using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;

namespace Pakpost.Application.Internal.Collections;

public sealed record SaveCollectionVariablesCommand(Guid ActorId, Guid WorkspaceId, Guid CollectionId,
    int Version, List<CollectionVariableDto> Variables) : IRequest<CollectionVariablesDto>;
