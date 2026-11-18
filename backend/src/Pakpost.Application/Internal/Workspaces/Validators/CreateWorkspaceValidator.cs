using FluentValidation;
using Pakpost.Application.Internal.Workspaces.Commands;

namespace Pakpost.Application.Internal.Workspaces.Validators;

public sealed class CreateWorkspaceValidator : AbstractValidator<CreateWorkspaceCommand>
{
    public CreateWorkspaceValidator() => RuleFor(x => x.Name).NotEmpty().MaximumLength(120);
}
