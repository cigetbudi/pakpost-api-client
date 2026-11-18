using System.Security.Cryptography;
using FluentValidation;
using Pakpost.Application.Internal.Auth.Commands;

namespace Pakpost.Application.Internal.Auth.Validators;

public sealed class GoogleLinkValidator : AbstractValidator<GoogleLinkCommand>
{
    public GoogleLinkValidator()
    {
        RuleFor(x => x.Credential).NotEmpty().MaximumLength(8192);
        RuleFor(x => x.Password).NotEmpty();
    }
}
