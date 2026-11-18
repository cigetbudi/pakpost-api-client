using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;
using Pakpost.Application.Common.Security;

namespace Pakpost.Application.Internal.Teams;

public sealed record ListTeamsQuery(Guid ActorId, Guid WorkspaceId) : IRequest<IReadOnlyList<TeamDto>>;
