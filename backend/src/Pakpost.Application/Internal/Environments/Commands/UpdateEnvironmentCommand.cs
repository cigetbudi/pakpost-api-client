using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;
using Pakpost.Application.Common.Security;

namespace Pakpost.Application.Internal.Environments;

public sealed record UpdateEnvironmentCommand(
    Guid ActorId,
    Guid WorkspaceId,
    Guid EnvironmentId,
    string Name,
    List<EnvironmentVariableDto> Variables
) : IRequest<RequestEnvironmentDto>;
