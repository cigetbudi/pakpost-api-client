using Mediator;
using Pakpost.Application.Internal.Auth.DTOs;

namespace Pakpost.Application.Internal.Auth.Commands;

public sealed record LoginCommand(string Email, string Password) : IRequest<LoginResult>;
