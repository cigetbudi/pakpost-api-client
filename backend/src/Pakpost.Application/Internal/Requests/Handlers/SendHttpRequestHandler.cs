using FluentValidation;
using Mediator;

namespace Pakpost.Application.Internal.Requests;

public sealed class SendHttpRequestHandler(IHttpRequestRunner runner) : IRequestHandler<SendHttpRequestCommand, SendHttpResponse>
{
    public ValueTask<SendHttpResponse> Handle(SendHttpRequestCommand cmd, CancellationToken ct) => new(runner.ExecuteAsync(cmd, ct));
}
