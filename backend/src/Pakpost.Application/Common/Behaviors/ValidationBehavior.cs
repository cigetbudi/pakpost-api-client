using FluentValidation;
using FluentValidation.Results;
using Mediator;

namespace Pakpost.Application.Common.Behaviors;

public sealed class ValidationBehavior<TRequest, TResponse>(IEnumerable<IValidator<TRequest>> validators)
    : IPipelineBehavior<TRequest, TResponse> where TRequest : notnull, IMessage
{
    public ValueTask<TResponse> Handle(
        TRequest request,
        MessageHandlerDelegate<TRequest, TResponse> next,
        CancellationToken cancellationToken)
    {
        // Most messages don't have validators. Preserve the ValueTask fast path
        // instead of allocating an async state machine for every request.
        if (!validators.Any())
            return next(request, cancellationToken);

        return ValidateAndContinueAsync(request, next, cancellationToken);
    }

    private async ValueTask<TResponse> ValidateAndContinueAsync(
        TRequest request,
        MessageHandlerDelegate<TRequest, TResponse> next,
        CancellationToken cancellationToken)
    {
        var context = new ValidationContext<TRequest>(request);
        List<ValidationFailure>? failures = null;

        foreach (var validator in validators)
        {
            var result = await validator.ValidateAsync(context, cancellationToken);
            if (result.IsValid) continue;
            failures ??= new List<ValidationFailure>();
            failures.AddRange(result.Errors.Where(x => x is not null));
        }

        if (failures is { Count: > 0 })
            throw new ValidationException(failures);

        return await next(request, cancellationToken);
    }
}
