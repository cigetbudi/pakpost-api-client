using System.Security.Cryptography;
using Mediator;
using Pakpost.Application.Internal.Auth.DTOs;

namespace Pakpost.Application.Internal.Auth.Queries;

public sealed record GoogleConnectionStatusQuery(Guid UserId) : IRequest<GoogleConnectionStatus>;
