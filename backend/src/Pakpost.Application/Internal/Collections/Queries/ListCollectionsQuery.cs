using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections;

public sealed record ListCollectionsQuery(Guid ActorId, Guid WorkspaceId) : IRequest<IReadOnlyList<CollectionDto>>;
