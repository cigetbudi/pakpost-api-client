using System.Security.Cryptography;
using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Auth;

public sealed record GoogleLinkCommand(Guid UserId, string Credential, string Password) : IRequest<GoogleLinkResult>;
