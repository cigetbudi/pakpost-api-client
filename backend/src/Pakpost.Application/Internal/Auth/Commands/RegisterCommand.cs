using Mediator;
using Pakpost.Application.Internal.Auth.DTOs;

namespace Pakpost.Application.Internal.Auth.Commands;

public sealed record RegisterCommand(string Email, string Password, string DisplayName) : IRequest<LoginResult>;
