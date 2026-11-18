using System.Text.Json;
using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections;

public sealed record ListSavedRequestsQuery(Guid ActorId, Guid WorkspaceId, Guid CollectionId) : IRequest<IReadOnlyList<SavedRequestDto>>;
