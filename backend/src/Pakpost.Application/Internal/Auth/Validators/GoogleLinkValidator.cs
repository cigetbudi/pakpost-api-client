using System.Security.Cryptography;
using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Auth;

public sealed class GoogleLinkValidator : AbstractValidator<GoogleLinkCommand>
{
    public GoogleLinkValidator()
    {
        RuleFor(x => x.Credential).NotEmpty().MaximumLength(8192);
        RuleFor(x => x.Password).NotEmpty();
    }
}
