using FluentValidation;
using Pakpost.Application.Internal.Auth.Commands;

namespace Pakpost.Application.Internal.Auth.Validators;

public sealed class LoginValidator : AbstractValidator<LoginCommand>
{
    public LoginValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty();
    }
}
