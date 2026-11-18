using System.Security.Cryptography;
using FluentValidation;
using Pakpost.Application.Internal.Auth.Commands;

namespace Pakpost.Application.Internal.Auth.Validators;

public sealed class GoogleLoginValidator : AbstractValidator<GoogleLoginCommand>
{
    public GoogleLoginValidator() => RuleFor(x => x.Credential).NotEmpty().MaximumLength(8192);
}
