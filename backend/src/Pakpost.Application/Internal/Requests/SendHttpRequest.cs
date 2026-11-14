using FluentValidation;
using MediatR;
namespace Pakpost.Application.Internal.Requests;
public sealed record HttpFormField(string Key,string? Value,string? FileName,string? Base64,string? ContentType);
public sealed record SendHttpRequestCommand(
    string Method,string Url,Dictionary<string,string>? Headers,string? Body,
    string? BodyMode=null,string? ContentType=null,List<HttpFormField>? FormFields=null,
    string? FileBase64=null,string? FileName=null):IRequest<SendHttpResponse>;
public sealed record SendHttpResponse(int StatusCode,string ReasonPhrase,long ElapsedMs,
    Dictionary<string,string> Headers,string Body,bool Truncated,bool IsBinary);
public interface IHttpRequestRunner { Task<SendHttpResponse> ExecuteAsync(SendHttpRequestCommand command,CancellationToken ct); }
public sealed class SendHttpRequestValidator:AbstractValidator<SendHttpRequestCommand>
{
    public SendHttpRequestValidator()
    {
        RuleFor(x=>x.Method).NotEmpty().Must(x=>x is not null && new[]{"GET","HEAD","POST","PUT","PATCH","DELETE","OPTIONS"}.Contains(x.ToUpperInvariant()));
        RuleFor(x=>x.Url).NotEmpty().MaximumLength(2048);
        RuleFor(x=>x.Body).Must(x=>x is null || System.Text.Encoding.UTF8.GetByteCount(x)<=131072).WithMessage("Body exceeds 128 KB");
        RuleFor(x=>x.BodyMode).Must(x=>x is null or "none" or "raw" or "urlencoded" or "multipart" or "binary");
        RuleFor(x=>x.FormFields).Must(x=>x is null || x.Count<=50);
        RuleFor(x=>x.FileBase64).Must(x=>x is null || x.Length<=7_000_000).WithMessage("Binary payload exceeds 5 MB");
        RuleFor(x=>x.Headers).Must(x=>x is null || x.Count<=40).WithMessage("At most 40 headers");
    }
}
public sealed class SendHttpRequestHandler(IHttpRequestRunner runner):IRequestHandler<SendHttpRequestCommand,SendHttpResponse>
{
    public Task<SendHttpResponse> Handle(SendHttpRequestCommand cmd,CancellationToken ct)=>runner.ExecuteAsync(cmd,ct);
}
