using Mediator;
using Pakpost.Application.Internal.Auth.DTOs;

namespace Pakpost.Application.Internal.Auth.Queries;

public sealed record GetMeQuery(Guid UserId) : IRequest<UserProfile>;
