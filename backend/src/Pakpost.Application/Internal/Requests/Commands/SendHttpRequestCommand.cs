using FluentValidation;
using Mediator;

namespace Pakpost.Application.Internal.Requests;

public sealed record SendHttpRequestCommand(
    string Method, string Url, Dictionary<string, string>? Headers, string? Body,
    string? BodyMode = null, string? ContentType = null, List<HttpFormField>? FormFields = null,
    string? FileBase64 = null, string? FileName = null):IRequest<SendHttpResponse>;
