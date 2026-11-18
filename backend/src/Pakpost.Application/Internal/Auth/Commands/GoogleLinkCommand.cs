using System.Security.Cryptography;
using Mediator;
using Pakpost.Application.Internal.Auth.DTOs;

namespace Pakpost.Application.Internal.Auth.Commands;

public sealed record GoogleLinkCommand(Guid UserId, string Credential, string Password) : IRequest<GoogleLinkResult>;
