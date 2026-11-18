using System.Security.Cryptography;
using Mediator;
using Pakpost.Application.Internal.Auth.DTOs;

namespace Pakpost.Application.Internal.Auth.Commands;

public sealed record GoogleLoginCommand(string Credential) : IRequest<LoginResult>;
