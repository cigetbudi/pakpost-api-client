using System.Text.Json;
using FluentValidation;
using Pakpost.Application.Common.Security;
using Pakpost.Application.Internal.Collections.Services;

namespace Pakpost.Application.Internal.Collections.Validators;

public abstract class SavedRequestPayloadValidator<TRequest> : AbstractValidator<TRequest>
    where TRequest : ISavedRequestPayload
{
    private static readonly HashSet<string> AllowedMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"
    };

    private static readonly HashSet<string> AllowedBodyModes = new(StringComparer.Ordinal)
    {
        "none", "raw", "urlencoded", "multipart", "binary"
    };

    protected SavedRequestPayloadValidator()
    {
        RuleFor(request => request.Name)
            .NotEmpty()
            .MaximumLength(120);

        RuleFor(request => request.Method)
            .Must(method => method is not null && AllowedMethods.Contains(method));

        RuleFor(request => request.Url)
            .NotEmpty()
            .MaximumLength(2048);

        RuleFor(request => request.HeadersJson)
            .Must(value => HasJsonKind(value, JsonValueKind.Object))
            .WithMessage("HeadersJson must be a JSON object");

        RuleFor(request => request.HeadersJson)
            .Must(SavedHeaderPolicy.ContainsNoLiteralCredentials)
            .WithMessage("Do not save literal tokens/passwords in sensitive headers. Use {{token}} / {{apiKey}} environment placeholders.");

        RuleFor(request => request.Body)
            .MaximumLength(131072);

        RuleFor(request => request.BodyMode)
            .Must(mode => mode is not null && AllowedBodyModes.Contains(mode));

        RuleFor(request => request.FormFieldsJson)
            .Must(value => HasJsonKind(value, JsonValueKind.Array))
            .WithMessage("FormFieldsJson must be a JSON array");

        RuleFor(request => request.PreRequestScript)
            .MaximumLength(64000);

        RuleFor(request => request.PostResponseScript)
            .MaximumLength(64000);
    }

    private static bool HasJsonKind(string? value, JsonValueKind kind)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        try
        {
            using var document = JsonDocument.Parse(value);
            return document.RootElement.ValueKind == kind;
        }
        catch (JsonException)
        {
            return false;
        }
    }
}
